-- Review round (Nov 10):
--  1. Referral partners may sign in with password only (2-step verification optional for them); client collaborators keep it mandatory.
--  2. Branded access e-mails: throttle log for "forgot password".
--  3. New-documents counter: the documents the user already opened.
--  4. Endeavor Bookkeeping: chart of accounts, journal, bank connections (Stripe Financial Connections / Plaid / CSV),
--     bank transactions with rules and AI suggestions, reconciliation, and P&L / Balance Sheet / Cash Flow / Trial Balance.

/* ---------- 1. partner MFA optional ---------- */
-- A partner session counts with password only while the user has no verified authenticator; once they turn one on, the code is required.
create or replace function public.my_partner_id() returns uuid language sql stable security definer set search_path = public as $$
  select p.id from public.partners p
   where p.user_id = auth.uid() and p.status = 'active'
     and (coalesce(auth.jwt()->>'aal', '') = 'aal2'
          or not exists (select 1 from auth.mfa_factors f where f.user_id = auth.uid() and f.status = 'verified'))
   limit 1;
$$;

-- What the partner portal needs to decide whether to ask for the authenticator
create or replace function public.portal_mfa_policy() returns jsonb language sql stable security definer set search_path = public as $$
  with u as (select id, lower(email) em from auth.users where id = auth.uid())
  select jsonb_build_object(
    'partner', exists (select 1 from public.partners p, u where (p.user_id = u.id and p.status = 'active') or (p.user_id is null and p.status = 'invited' and lower(p.email) = u.em)),
    'collaborator', exists (select 1 from public.client_users cu, u where cu.status in ('active', 'invited') and (cu.user_id = u.id or lower(cu.email) = u.em)),
    'has_factor', exists (select 1 from auth.mfa_factors f where f.user_id = auth.uid() and f.status = 'verified'),
    'optional', exists (select 1 from public.partners p, u where (p.user_id = u.id and p.status = 'active') or (p.user_id is null and p.status = 'invited' and lower(p.email) = u.em))
                and not exists (select 1 from public.client_users cu, u where cu.status in ('active', 'invited') and (cu.user_id = u.id or lower(cu.email) = u.em))
                and not exists (select 1 from public.admins a, u where lower(a.email) = u.em)
                and not exists (select 1 from auth.mfa_factors f where f.user_id = auth.uid() and f.status = 'verified'))
$$;
revoke all on function public.portal_mfa_policy() from public, anon;
grant execute on function public.portal_mfa_policy() to authenticated;

/* ---------- 2. access e-mail throttle ---------- */
create table if not exists public.access_mail_log (id bigint generated always as identity primary key, email text not null, kind text not null default 'reset', sent_at timestamptz not null default now());
create index if not exists access_mail_log_e on public.access_mail_log(email, sent_at);
alter table public.access_mail_log enable row level security;

/* ---------- 3. documents I already opened ---------- */
create or replace function public.my_doc_views(p_client uuid) returns setof uuid language sql stable security definer set search_path = public as $$
  select distinct l.document_id from public.doc_access_log l join public.company_documents d on d.id = l.document_id
   where l.user_id = auth.uid() and d.client_id = p_client;
$$;
revoke all on function public.my_doc_views(uuid) from public, anon;
grant execute on function public.my_doc_views(uuid) to authenticated;

/* ---------- 4. Endeavor Bookkeeping ---------- */
alter table public.companies add column if not exists books_provider text not null default 'none' check (books_provider in ('none', 'quickbooks', 'endeavor'));
update public.companies c set books_provider = 'quickbooks' where books_provider = 'none' and exists (select 1 from public.qbo_connections q where q.company_id = c.id);

create table if not exists public.bk_accounts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  code text not null check (code ~ '^[0-9A-Za-z.-]{1,12}$'),
  name text not null check (char_length(name) between 1 and 120),
  type text not null check (type in ('asset', 'liability', 'equity', 'income', 'expense')),
  subtype text not null check (subtype in ('bank', 'accounts_receivable', 'other_current_asset', 'fixed_asset', 'other_asset',
    'credit_card', 'accounts_payable', 'other_current_liability', 'long_term_liability', 'equity', 'retained_earnings',
    'income', 'other_income', 'cogs', 'expense', 'other_expense')),
  description text check (description is null or char_length(description) <= 300),
  tax_line text check (tax_line is null or char_length(tax_line) <= 80),
  is_active boolean not null default true,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  unique (company_id, code)
);
create index if not exists bk_accounts_c on public.bk_accounts(company_id, type);

create table if not exists public.bk_entries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  number bigint generated always as identity,
  entry_date date not null,
  memo text check (memo is null or char_length(memo) <= 500),
  source text not null default 'manual' check (source in ('manual', 'bank', 'opening', 'adjustment', 'import')),
  status text not null default 'posted' check (status in ('posted', 'void')),
  created_by text, created_at timestamptz not null default now(), voided_at timestamptz
);
create index if not exists bk_entries_c on public.bk_entries(company_id, entry_date);
create table if not exists public.bk_lines (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.bk_entries(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  account_id uuid not null references public.bk_accounts(id),
  debit_cents bigint not null default 0 check (debit_cents >= 0),
  credit_cents bigint not null default 0 check (credit_cents >= 0),
  description text check (description is null or char_length(description) <= 300),
  contact text check (contact is null or char_length(contact) <= 120),
  cleared boolean not null default false,
  reconciliation_id uuid,
  check ((debit_cents = 0) <> (credit_cents = 0))
);
create index if not exists bk_lines_a on public.bk_lines(account_id);
create index if not exists bk_lines_e on public.bk_lines(entry_id);

create table if not exists public.bk_connections (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  provider text not null check (provider in ('stripe', 'plaid', 'csv')),
  institution text, external_id text,
  status text not null default 'active' check (status in ('active', 'error', 'disconnected')),
  last_sync_at timestamptz, last_error text, created_at timestamptz not null default now(), created_by text
);
-- tokens and cursors: no policies, only the server reads them
create table if not exists public.bk_secrets (connection_id uuid primary key references public.bk_connections(id) on delete cascade, access_token text, cursor text, customer text);
create table if not exists public.bk_bank_accounts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  connection_id uuid references public.bk_connections(id) on delete set null,
  external_id text, name text not null, mask text, kind text not null default 'checking' check (kind in ('checking', 'savings', 'credit_card', 'other')),
  currency text not null default 'usd', balance_cents bigint, balance_at timestamptz,
  ledger_account_id uuid not null references public.bk_accounts(id),
  is_active boolean not null default true, created_at timestamptz not null default now(),
  unique (connection_id, external_id)
);
create table if not exists public.bk_transactions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  bank_account_id uuid not null references public.bk_bank_accounts(id) on delete cascade,
  external_id text not null,
  txn_date date not null,
  description text not null default '',
  merchant text,
  amount_cents bigint not null, -- money in > 0, money out < 0
  pending boolean not null default false,
  status text not null default 'review' check (status in ('review', 'posted', 'excluded')),
  suggested_account_id uuid references public.bk_accounts(id) on delete set null,
  suggest_source text check (suggest_source in ('rule', 'ai', 'history')),
  ai_confidence numeric, ai_reason text,
  account_id uuid references public.bk_accounts(id) on delete set null,
  entry_id uuid references public.bk_entries(id) on delete set null,
  memo text, created_at timestamptz not null default now(),
  unique (bank_account_id, external_id)
);
create index if not exists bk_tx_c on public.bk_transactions(company_id, status, txn_date);
create table if not exists public.bk_rules (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  match_text text not null check (char_length(match_text) between 2 and 80),
  direction text not null default 'any' check (direction in ('any', 'in', 'out')),
  account_id uuid not null references public.bk_accounts(id) on delete cascade,
  auto_post boolean not null default false,
  created_at timestamptz not null default now()
);
create table if not exists public.bk_reconciliations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  bank_account_id uuid not null references public.bk_bank_accounts(id) on delete cascade,
  statement_date date not null, statement_balance_cents bigint not null,
  status text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  completed_at timestamptz, created_at timestamptz not null default now(), created_by text
);

do $$ declare t text; begin
  foreach t in array array['bk_accounts', 'bk_entries', 'bk_lines', 'bk_connections', 'bk_bank_accounts', 'bk_transactions', 'bk_rules', 'bk_reconciliations'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_admin_read', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.is_admin())', t || '_admin_read', t);
  end loop;
end $$;
alter table public.bk_secrets enable row level security;
-- accounts and rules are edited directly by the team; money moves only through the functions below
drop policy if exists bk_accounts_admin_w on public.bk_accounts;
create policy bk_accounts_admin_w on public.bk_accounts for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists bk_rules_admin_w on public.bk_rules;
create policy bk_rules_admin_w on public.bk_rules for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- standard chart of accounts for a US small business (LLC)
create or replace function public.bk_seed_chart(p_company uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.bk_accounts(company_id, code, name, type, subtype, is_system) values
    (p_company, '1100', 'Accounts Receivable', 'asset', 'accounts_receivable', false),
    (p_company, '1200', 'Undeposited Funds', 'asset', 'other_current_asset', false),
    (p_company, '1300', 'Prepaid Expenses', 'asset', 'other_current_asset', false),
    (p_company, '1500', 'Equipment', 'asset', 'fixed_asset', false),
    (p_company, '1510', 'Accumulated Depreciation', 'asset', 'fixed_asset', false),
    (p_company, '1600', 'Security Deposits', 'asset', 'other_asset', false),
    (p_company, '2000', 'Accounts Payable', 'liability', 'accounts_payable', false),
    (p_company, '2200', 'Sales Tax Payable', 'liability', 'other_current_liability', false),
    (p_company, '2300', 'Payroll Liabilities', 'liability', 'other_current_liability', false),
    (p_company, '2700', 'Loans from Members', 'liability', 'long_term_liability', false),
    (p_company, '2800', 'Long-term Loan', 'liability', 'long_term_liability', false),
    (p_company, '3000', 'Member Contributions', 'equity', 'equity', false),
    (p_company, '3100', 'Member Distributions', 'equity', 'equity', false),
    (p_company, '3900', 'Retained Earnings', 'equity', 'retained_earnings', true),
    (p_company, '3999', 'Opening Balance Equity', 'equity', 'equity', true),
    (p_company, '4000', 'Sales', 'income', 'income', false),
    (p_company, '4100', 'Service Revenue', 'income', 'income', false),
    (p_company, '4200', 'Consulting Income', 'income', 'income', false),
    (p_company, '4800', 'Refunds & Returns', 'income', 'income', false),
    (p_company, '4900', 'Other Income', 'income', 'other_income', false),
    (p_company, '4910', 'Interest Income', 'income', 'other_income', false),
    (p_company, '4999', 'Uncategorized Income', 'income', 'income', true),
    (p_company, '5000', 'Cost of Goods Sold', 'expense', 'cogs', false),
    (p_company, '5100', 'Subcontractors (COGS)', 'expense', 'cogs', false),
    (p_company, '5200', 'Merchant & Payment Processing Fees', 'expense', 'cogs', false),
    (p_company, '6000', 'Advertising & Marketing', 'expense', 'expense', false),
    (p_company, '6010', 'Bank Fees & Service Charges', 'expense', 'expense', false),
    (p_company, '6020', 'Car & Truck', 'expense', 'expense', false),
    (p_company, '6030', 'Contract Labor', 'expense', 'expense', false),
    (p_company, '6040', 'Dues & Subscriptions', 'expense', 'expense', false),
    (p_company, '6050', 'Insurance', 'expense', 'expense', false),
    (p_company, '6060', 'Legal & Professional Fees', 'expense', 'expense', false),
    (p_company, '6070', 'Meals', 'expense', 'expense', false),
    (p_company, '6080', 'Office Supplies & Software', 'expense', 'expense', false),
    (p_company, '6090', 'Rent & Lease', 'expense', 'expense', false),
    (p_company, '6100', 'Repairs & Maintenance', 'expense', 'expense', false),
    (p_company, '6110', 'Taxes & Licenses', 'expense', 'expense', false),
    (p_company, '6120', 'Travel', 'expense', 'expense', false),
    (p_company, '6130', 'Utilities', 'expense', 'expense', false),
    (p_company, '6140', 'Telephone & Internet', 'expense', 'expense', false),
    (p_company, '6150', 'Payroll Wages', 'expense', 'expense', false),
    (p_company, '6160', 'Payroll Taxes', 'expense', 'expense', false),
    (p_company, '6170', 'Shipping & Postage', 'expense', 'expense', false),
    (p_company, '6180', 'Training & Education', 'expense', 'expense', false),
    (p_company, '6190', 'Depreciation', 'expense', 'expense', false),
    (p_company, '6999', 'Uncategorized Expense', 'expense', 'expense', true),
    (p_company, '8000', 'Interest Expense', 'expense', 'other_expense', false),
    (p_company, '8100', 'Other Expense', 'expense', 'other_expense', false)
  on conflict (company_id, code) do nothing;
end $$;
revoke all on function public.bk_seed_chart(uuid) from public, anon, authenticated;

create or replace function public.bk_set_provider(p_company uuid, p_provider text) returns text language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if p_provider not in ('none', 'quickbooks', 'endeavor') then raise exception 'invalid_provider'; end if;
  update public.companies set books_provider = p_provider, updated_at = now() where id = p_company;
  if not found then raise exception 'not_found'; end if;
  if p_provider = 'endeavor' then perform public.bk_seed_chart(p_company); end if;
  return p_provider;
end $$;
revoke all on function public.bk_set_provider(uuid, text) from public, anon;
grant execute on function public.bk_set_provider(uuid, text) to authenticated;

-- next free code inside a range (bank accounts 1000-1099, cards 2100-2199)
create or replace function public.bk_next_code(p_company uuid, p_from int, p_to int) returns text language sql stable security definer set search_path = public as $$
  select coalesce((select min(g)::text from generate_series(p_from, p_to) g where not exists (select 1 from public.bk_accounts a where a.company_id = p_company and a.code = g::text)), p_to::text || '-' || substr(md5(random()::text), 1, 3))
$$;
revoke all on function public.bk_next_code(uuid, int, int) from public, anon, authenticated;

-- bank / card account in the books (linked by Stripe/Plaid or created for CSV import)
create or replace function public.bk_add_bank_account(p_company uuid, p_connection uuid, p_external text, p_name text, p_mask text, p_kind text, p_currency text, p_balance bigint)
 returns uuid language plpgsql security definer set search_path = public as $$
declare v uuid; a uuid; k text := case when p_kind in ('checking', 'savings', 'credit_card', 'other') then p_kind else 'other' end;
begin
  if not (public.is_admin() or auth.role() = 'service_role') then raise exception 'forbidden'; end if;
  select id into v from public.bk_bank_accounts where connection_id is not distinct from p_connection and external_id = p_external and p_external is not null;
  if v is not null then
    update public.bk_bank_accounts set balance_cents = coalesce(p_balance, balance_cents), balance_at = case when p_balance is null then balance_at else now() end, is_active = true where id = v;
    return v;
  end if;
  insert into public.bk_accounts(company_id, code, name, type, subtype)
  values (p_company, case when k = 'credit_card' then public.bk_next_code(p_company, 2100, 2199) else public.bk_next_code(p_company, 1000, 1099) end,
          left(coalesce(nullif(btrim(p_name), ''), 'Bank') || coalesce(' ...' || nullif(p_mask, ''), ''), 120),
          case when k = 'credit_card' then 'liability' else 'asset' end, case when k = 'credit_card' then 'credit_card' else 'bank' end)
  returning id into a;
  insert into public.bk_bank_accounts(company_id, connection_id, external_id, name, mask, kind, currency, balance_cents, balance_at, ledger_account_id)
  values (p_company, p_connection, p_external, left(coalesce(nullif(btrim(p_name), ''), 'Bank'), 120), left(p_mask, 8), k, lower(coalesce(p_currency, 'usd')), p_balance, case when p_balance is null then null else now() end, a)
  returning id into v;
  return v;
end $$;
revoke all on function public.bk_add_bank_account(uuid, uuid, text, text, text, text, text, bigint) from public, anon;
grant execute on function public.bk_add_bank_account(uuid, uuid, text, text, text, text, text, bigint) to authenticated, service_role;

-- post a balanced journal entry: p_lines = [{account_id, debit_cents, credit_cents, description, contact}]
create or replace function public.bk_post_core(p_company uuid, p_date date, p_memo text, p_lines jsonb, p_source text, p_by text) returns uuid
 language plpgsql security definer set search_path = public as $$
declare v uuid; l jsonb; dr bigint := 0; cr bigint := 0; n int := 0;
begin
  if p_date is null then raise exception 'invalid_date'; end if;
  for l in select * from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) loop
    if coalesce((l->>'debit_cents')::bigint, 0) < 0 or coalesce((l->>'credit_cents')::bigint, 0) < 0 then raise exception 'negative_amount'; end if;
    if (coalesce((l->>'debit_cents')::bigint, 0) = 0) = (coalesce((l->>'credit_cents')::bigint, 0) = 0) then raise exception 'line_needs_debit_or_credit'; end if;
    if not exists (select 1 from public.bk_accounts a where a.id = (l->>'account_id')::uuid and a.company_id = p_company) then raise exception 'invalid_account'; end if;
    dr := dr + coalesce((l->>'debit_cents')::bigint, 0); cr := cr + coalesce((l->>'credit_cents')::bigint, 0); n := n + 1;
  end loop;
  if n < 2 then raise exception 'needs_two_lines'; end if;
  if dr <> cr then raise exception 'not_balanced'; end if;
  insert into public.bk_entries(company_id, entry_date, memo, source, created_by) values (p_company, p_date, left(nullif(btrim(coalesce(p_memo, '')), ''), 500), coalesce(p_source, 'manual'), p_by) returning id into v;
  insert into public.bk_lines(entry_id, company_id, account_id, debit_cents, credit_cents, description, contact)
  select v, p_company, (x->>'account_id')::uuid, coalesce((x->>'debit_cents')::bigint, 0), coalesce((x->>'credit_cents')::bigint, 0),
         left(nullif(btrim(coalesce(x->>'description', '')), ''), 300), left(nullif(btrim(coalesce(x->>'contact', '')), ''), 120)
    from jsonb_array_elements(p_lines) as j(x);
  return v;
end $$;
revoke all on function public.bk_post_core(uuid, date, text, jsonb, text, text) from public, anon, authenticated;

create or replace function public.bk_post_entry(p_company uuid, p_date date, p_memo text, p_lines jsonb, p_source text default 'manual') returns uuid
 language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if p_source not in ('manual', 'opening', 'adjustment') then raise exception 'invalid_source'; end if;
  return public.bk_post_core(p_company, p_date, p_memo, p_lines, p_source, auth.jwt()->>'email');
end $$;
revoke all on function public.bk_post_entry(uuid, date, text, jsonb, text) from public, anon;
grant execute on function public.bk_post_entry(uuid, date, text, jsonb, text) to authenticated;

create or replace function public.bk_void_entry(p_entry uuid) returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if exists (select 1 from public.bk_lines where entry_id = p_entry and reconciliation_id is not null) then raise exception 'reconciled'; end if;
  update public.bk_entries set status = 'void', voided_at = now() where id = p_entry and status = 'posted';
  update public.bk_transactions set status = 'review', entry_id = null, account_id = null where entry_id = p_entry;
  return true;
end $$;
revoke all on function public.bk_void_entry(uuid) from public, anon;
grant execute on function public.bk_void_entry(uuid) to authenticated;

-- suggestion for one transaction: rule first, then the account used last time for the same payee
create or replace function public.bk_suggest(p_txn uuid) returns void language plpgsql security definer set search_path = public as $$
declare t public.bk_transactions; r public.bk_rules; h uuid; key text;
begin
  select * into t from public.bk_transactions where id = p_txn;
  if t.id is null or t.status <> 'review' then return; end if;
  select * into r from public.bk_rules where company_id = t.company_id
     and position(lower(match_text) in lower(coalesce(t.merchant, '') || ' ' || t.description)) > 0
     and (direction = 'any' or (direction = 'in' and t.amount_cents > 0) or (direction = 'out' and t.amount_cents < 0))
   order by char_length(match_text) desc limit 1;
  if r.id is not null then
    update public.bk_transactions set suggested_account_id = r.account_id, suggest_source = 'rule', ai_confidence = 1, ai_reason = 'Rule: ' || r.match_text where id = t.id;
    return;
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

-- post one bank transaction to the books (bank side + category side)
create or replace function public.bk_post_txn_core(p_txn uuid, p_account uuid, p_memo text, p_by text) returns uuid language plpgsql security definer set search_path = public as $$
declare t public.bk_transactions; b public.bk_bank_accounts; v uuid; amt bigint; lines jsonb;
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
  return v;
end $$;
revoke all on function public.bk_post_txn_core(uuid, uuid, text, text) from public, anon, authenticated;

create or replace function public.bk_accept_txn(p_txn uuid, p_account uuid, p_memo text default null, p_rule text default null) returns uuid
 language plpgsql security definer set search_path = public as $$
declare v uuid; t public.bk_transactions;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  select * into t from public.bk_transactions where id = p_txn;
  v := public.bk_post_txn_core(p_txn, p_account, p_memo, auth.jwt()->>'email');
  if nullif(btrim(coalesce(p_rule, '')), '') is not null then
    insert into public.bk_rules(company_id, match_text, direction, account_id) values (t.company_id, left(btrim(p_rule), 80), case when t.amount_cents > 0 then 'in' else 'out' end, p_account);
    -- apply the new rule to the rest of the queue
    perform public.bk_suggest(x.id) from public.bk_transactions x where x.company_id = t.company_id and x.status = 'review' and (x.suggest_source is distinct from 'rule');
  end if;
  return v;
end $$;
revoke all on function public.bk_accept_txn(uuid, uuid, text, text) from public, anon;
grant execute on function public.bk_accept_txn(uuid, uuid, text, text) to authenticated;

-- accept all suggestions of the selected transactions
create or replace function public.bk_accept_many(p_ids uuid[]) returns int language plpgsql security definer set search_path = public as $$
declare t record; n int := 0;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  for t in select id, suggested_account_id from public.bk_transactions where id = any(p_ids) and status = 'review' and suggested_account_id is not null loop
    perform public.bk_post_txn_core(t.id, t.suggested_account_id, null, auth.jwt()->>'email'); n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.bk_accept_many(uuid[]) from public, anon;
grant execute on function public.bk_accept_many(uuid[]) to authenticated;

create or replace function public.bk_set_txn_status(p_txn uuid, p_status text) returns boolean language plpgsql security definer set search_path = public as $$
declare t public.bk_transactions;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  select * into t from public.bk_transactions where id = p_txn;
  if t.id is null then raise exception 'not_found'; end if;
  if p_status = 'excluded' and t.status = 'review' then update public.bk_transactions set status = 'excluded' where id = t.id;
  elsif p_status = 'review' and t.status = 'excluded' then update public.bk_transactions set status = 'review' where id = t.id; perform public.bk_suggest(t.id);
  elsif p_status = 'review' and t.status = 'posted' then perform public.bk_void_entry(t.entry_id); perform public.bk_suggest(t.id);
  else raise exception 'invalid_status'; end if;
  return true;
end $$;
revoke all on function public.bk_set_txn_status(uuid, text) from public, anon;
grant execute on function public.bk_set_txn_status(uuid, text) to authenticated;

-- import bank lines (server sync or CSV): p_rows = [{external_id, date, description, merchant, amount_cents, pending}]
create or replace function public.bk_import_core(p_bank uuid, p_rows jsonb) returns int language plpgsql security definer set search_path = public as $$
declare b public.bk_bank_accounts; r jsonb; v uuid; n int := 0;
begin
  select * into b from public.bk_bank_accounts where id = p_bank;
  if b.id is null then raise exception 'not_found'; end if;
  for r in select * from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) loop
    continue when (r->>'amount_cents') is null or (r->>'date') is null or coalesce((r->>'amount_cents')::bigint, 0) = 0;
    insert into public.bk_transactions(company_id, bank_account_id, external_id, txn_date, description, merchant, amount_cents, pending)
    values (b.company_id, b.id, coalesce(nullif(r->>'external_id', ''), md5(b.id::text || (r->>'date') || coalesce(r->>'description', '') || (r->>'amount_cents'))),
            (r->>'date')::date, left(coalesce(r->>'description', ''), 300), left(nullif(r->>'merchant', ''), 120), (r->>'amount_cents')::bigint, coalesce((r->>'pending')::boolean, false))
    on conflict (bank_account_id, external_id) do update set pending = excluded.pending, txn_date = excluded.txn_date,
       amount_cents = case when public.bk_transactions.status = 'review' then excluded.amount_cents else public.bk_transactions.amount_cents end
    returning id into v;
    if v is not null then perform public.bk_suggest(v); n := n + 1; end if;
  end loop;
  return n;
end $$;
revoke all on function public.bk_import_core(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.bk_import_core(uuid, jsonb) to service_role;

create or replace function public.bk_import_csv(p_bank uuid, p_rows jsonb) returns int language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if jsonb_array_length(coalesce(p_rows, '[]'::jsonb)) > 5000 then raise exception 'too_many_rows'; end if;
  return public.bk_import_core(p_bank, p_rows);
end $$;
revoke all on function public.bk_import_csv(uuid, jsonb) from public, anon;
grant execute on function public.bk_import_csv(uuid, jsonb) to authenticated;

-- AI suggestions are saved by the server
create or replace function public.bk_save_ai(p_rows jsonb) returns int language plpgsql security definer set search_path = public as $$
declare r jsonb; n int := 0;
begin
  for r in select * from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) loop
    update public.bk_transactions t set suggested_account_id = (r->>'account_id')::uuid, suggest_source = 'ai', ai_confidence = least(1, greatest(0, coalesce((r->>'confidence')::numeric, 0.5))), ai_reason = left(r->>'reason', 200)
     where t.id = (r->>'id')::uuid and t.status = 'review' and t.suggest_source is distinct from 'rule'
       and exists (select 1 from public.bk_accounts a where a.id = (r->>'account_id')::uuid and a.company_id = t.company_id);
    if found then n := n + 1; end if;
  end loop;
  return n;
end $$;
revoke all on function public.bk_save_ai(jsonb) from public, anon, authenticated;
grant execute on function public.bk_save_ai(jsonb) to service_role;

-- account balances between two dates (posted entries only); natural sign: debit-normal for assets/expenses, credit-normal otherwise
create or replace function public.bk_balances(p_company uuid, p_from date, p_to date)
 returns table(account_id uuid, code text, name text, type text, subtype text, debit bigint, credit bigint, balance bigint)
 language sql stable security definer set search_path = public as $$
  select a.id, a.code, a.name, a.type, a.subtype, coalesce(sum(l.debit_cents), 0)::bigint, coalesce(sum(l.credit_cents), 0)::bigint,
         (case when a.type in ('asset', 'expense') then coalesce(sum(l.debit_cents), 0) - coalesce(sum(l.credit_cents), 0)
               else coalesce(sum(l.credit_cents), 0) - coalesce(sum(l.debit_cents), 0) end)::bigint
    from public.bk_accounts a
    left join public.bk_lines l on l.account_id = a.id and exists (select 1 from public.bk_entries e where e.id = l.entry_id and e.status = 'posted'
                                   and (p_from is null or e.entry_date >= p_from) and e.entry_date <= p_to)
   where a.company_id = p_company
   group by a.id
$$;
revoke all on function public.bk_balances(uuid, date, date) from public, anon, authenticated;

-- first day of the fiscal year that contains p_day (from companies.fiscal_year_end MM-DD)
create or replace function public.bk_fy_start(p_company uuid, p_day date) returns date language plpgsql stable security definer set search_path = public as $$
declare fye text; m int; d int; s date;
begin
  select coalesce(nullif(fiscal_year_end, ''), '12-31') into fye from public.companies where id = p_company;
  begin m := split_part(fye, '-', 1)::int; d := split_part(fye, '-', 2)::int; exception when others then m := 12; d := 31; end;
  if m not between 1 and 12 then m := 12; d := 31; end if;
  s := (make_date(extract(year from p_day)::int, m, 1) + interval '1 month' - interval '1 day')::date; -- last day of the FYE month
  s := least(s, make_date(extract(year from p_day)::int, m, least(greatest(d, 1), extract(day from s)::int))) + 1;
  if s > p_day then s := (s - interval '1 year')::date; end if;
  return s;
end $$;
revoke all on function public.bk_fy_start(uuid, date) from public, anon, authenticated;

-- reports: pl | bs | cf | tb  (amounts in cents)
create or replace function public.bk_report(p_company uuid, p_kind text, p_from date, p_to date) returns jsonb
 language plpgsql stable security definer set search_path = public as $$
declare res jsonb; fy date; ni_period bigint; ni_ytd bigint; re_prior bigint; re_manual bigint; cash0 bigint; cash1 bigint; co public.companies;
begin
  if not (public.is_admin() or auth.role() = 'service_role') then raise exception 'forbidden'; end if;
  select * into co from public.companies where id = p_company;
  if co.id is null then raise exception 'not_found'; end if;
  if p_kind = 'pl' then
    with b as (select * from public.bk_balances(p_company, p_from, p_to) where type in ('income', 'expense')),
    s as (select x.k, x.title, x.ord, coalesce(jsonb_agg(jsonb_build_object('account_id', b.account_id, 'code', b.code, 'name', b.name, 'amount', b.balance) order by b.code) filter (where b.balance <> 0), '[]') rows,
                 coalesce(sum(b.balance), 0)::bigint total
            from (values ('income', 'Income', 1), ('cogs', 'Cost of Goods Sold', 2), ('expense', 'Expenses', 3), ('other_income', 'Other Income', 4), ('other_expense', 'Other Expenses', 5)) x(k, title, ord)
            left join b on b.subtype = x.k group by x.k, x.title, x.ord)
    select jsonb_build_object('kind', 'pl', 'from', p_from, 'to', p_to, 'company', co.legal_name,
      'sections', jsonb_agg(jsonb_build_object('key', k, 'title', title, 'rows', rows, 'total', total) order by ord),
      'gross_profit', sum(case k when 'income' then total when 'cogs' then -total else 0 end),
      'operating_income', sum(case k when 'income' then total when 'cogs' then -total when 'expense' then -total else 0 end),
      'net_income', sum(case k when 'income' then total when 'other_income' then total else -total end)) into res from s;
    return res;
  elsif p_kind = 'bs' then
    fy := public.bk_fy_start(p_company, p_to);
    select coalesce(sum(case when type = 'income' then balance else -balance end), 0) into ni_ytd from public.bk_balances(p_company, fy, p_to) where type in ('income', 'expense');
    select coalesce(sum(case when type = 'income' then balance else -balance end), 0) into re_prior from public.bk_balances(p_company, null, fy - 1) where type in ('income', 'expense');
    select coalesce(sum(balance), 0) into re_manual from public.bk_balances(p_company, null, p_to) where subtype = 'retained_earnings';
    with b as (select * from public.bk_balances(p_company, null, p_to) where type in ('asset', 'liability', 'equity')),
    s as (select x.k, x.grp, x.title, x.ord,
                 coalesce(jsonb_agg(jsonb_build_object('account_id', b.account_id, 'code', b.code, 'name', b.name, 'amount', b.balance) order by b.code) filter (where b.balance <> 0), '[]') rows,
                 coalesce(sum(b.balance), 0)::bigint total
            from (values ('bank', 'assets', 'Bank Accounts', 1), ('accounts_receivable', 'assets', 'Accounts Receivable', 2), ('other_current_asset', 'assets', 'Other Current Assets', 3),
                         ('fixed_asset', 'assets', 'Fixed Assets', 4), ('other_asset', 'assets', 'Other Assets', 5),
                         ('accounts_payable', 'liabilities', 'Accounts Payable', 6), ('credit_card', 'liabilities', 'Credit Cards', 7), ('other_current_liability', 'liabilities', 'Other Current Liabilities', 8),
                         ('long_term_liability', 'liabilities', 'Long-term Liabilities', 9), ('equity', 'equity', 'Equity', 10)) x(k, grp, title, ord)
            left join b on b.subtype = x.k group by x.k, x.grp, x.title, x.ord)
    select jsonb_build_object('kind', 'bs', 'to', p_to, 'company', co.legal_name, 'fy_start', fy,
      'sections', jsonb_agg(jsonb_build_object('key', k, 'group', grp, 'title', title, 'rows', rows, 'total', total) order by ord),
      'retained_earnings', re_prior + re_manual, 'net_income', ni_ytd,
      'total_assets', coalesce(sum(total) filter (where grp = 'assets'), 0), 'total_liabilities', coalesce(sum(total) filter (where grp = 'liabilities'), 0),
      'total_equity', coalesce(sum(total) filter (where grp = 'equity'), 0) + re_prior + re_manual + ni_ytd) into res from s;
    return res;
  elsif p_kind = 'cf' then
    select coalesce(sum(case when type = 'income' then balance else -balance end), 0) into ni_period from public.bk_balances(p_company, p_from, p_to) where type in ('income', 'expense');
    select coalesce(sum(balance), 0) into cash0 from public.bk_balances(p_company, null, p_from - 1) where subtype = 'bank';
    select coalesce(sum(balance), 0) into cash1 from public.bk_balances(p_company, null, p_to) where subtype = 'bank';
    -- change of each balance-sheet account in the period, as cash effect: assets up = cash down; liabilities/equity up = cash up
    with ch as (select b.account_id, b.code, b.name, b.subtype, (case when b.type = 'asset' then -b.balance else b.balance end)::bigint eff
                  from public.bk_balances(p_company, p_from, p_to) b where b.type in ('asset', 'liability', 'equity') and b.subtype <> 'bank'),
    s as (select x.k, x.title, x.ord, coalesce(jsonb_agg(jsonb_build_object('account_id', ch.account_id, 'code', ch.code, 'name', ch.name, 'amount', ch.eff) order by ch.code) filter (where ch.eff <> 0), '[]') rows,
                 coalesce(sum(ch.eff), 0)::bigint total
            from (values ('operating', 'Adjustments to reconcile net income', 1, array['accounts_receivable', 'other_current_asset', 'accounts_payable', 'credit_card', 'other_current_liability']),
                         ('investing', 'Investing Activities', 2, array['fixed_asset', 'other_asset']),
                         ('financing', 'Financing Activities', 3, array['long_term_liability', 'equity', 'retained_earnings'])) x(k, title, ord, subs)
            left join ch on ch.subtype = any(x.subs) group by x.k, x.title, x.ord)
    select jsonb_build_object('kind', 'cf', 'from', p_from, 'to', p_to, 'company', co.legal_name, 'net_income', ni_period,
      'sections', jsonb_agg(jsonb_build_object('key', k, 'title', title, 'rows', rows, 'total', total) order by ord),
      'operating_total', ni_period + coalesce(sum(total) filter (where k = 'operating'), 0),
      'net_change', ni_period + coalesce(sum(total), 0), 'cash_start', cash0, 'cash_end', cash1) into res from s;
    return res;
  elsif p_kind = 'tb' then
    select jsonb_build_object('kind', 'tb', 'to', p_to, 'company', co.legal_name,
      'rows', coalesce(jsonb_agg(jsonb_build_object('account_id', account_id, 'code', code, 'name', name, 'type', type,
               'debit', greatest(debit - credit, 0), 'credit', greatest(credit - debit, 0)) order by code) filter (where debit <> credit), '[]'),
      'total_debit', coalesce(sum(greatest(debit - credit, 0)), 0), 'total_credit', coalesce(sum(greatest(credit - debit, 0)), 0)) into res
      from public.bk_balances(p_company, null, p_to);
    return res;
  end if;
  raise exception 'invalid_report';
end $$;
revoke all on function public.bk_report(uuid, text, date, date) from public, anon;
grant execute on function public.bk_report(uuid, text, date, date) to authenticated, service_role;

-- general ledger of one account with running balance
create or replace function public.bk_ledger(p_account uuid, p_from date, p_to date)
 returns table(line_id uuid, entry_id uuid, number bigint, entry_date date, memo text, description text, source text, debit bigint, credit bigint, balance bigint, cleared boolean, reconciled boolean)
 language plpgsql stable security definer set search_path = public as $$
declare a public.bk_accounts; open bigint;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  select * into a from public.bk_accounts where id = p_account;
  select coalesce(sum(case when a.type in ('asset', 'expense') then l.debit_cents - l.credit_cents else l.credit_cents - l.debit_cents end), 0) into open
    from public.bk_lines l join public.bk_entries e on e.id = l.entry_id where l.account_id = p_account and e.status = 'posted' and e.entry_date < p_from;
  return query
    select l.id, e.id, e.number, e.entry_date, e.memo, l.description, e.source, l.debit_cents, l.credit_cents,
           (open + sum(case when a.type in ('asset', 'expense') then l.debit_cents - l.credit_cents else l.credit_cents - l.debit_cents end) over (order by e.entry_date, e.number, l.id))::bigint,
           l.cleared, l.reconciliation_id is not null
      from public.bk_lines l join public.bk_entries e on e.id = l.entry_id
     where l.account_id = p_account and e.status = 'posted' and e.entry_date between p_from and p_to
     order by e.entry_date, e.number, l.id;
end $$;
revoke all on function public.bk_ledger(uuid, date, date) from public, anon;
grant execute on function public.bk_ledger(uuid, date, date) to authenticated;

-- reconciliation: lines of the bank's ledger account up to the statement date, and finishing it
create or replace function public.bk_recon_lines(p_bank uuid, p_to date)
 returns table(line_id uuid, entry_date date, description text, amount bigint, cleared boolean)
 language plpgsql stable security definer set search_path = public as $$
declare b public.bk_bank_accounts; a public.bk_accounts;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  select * into b from public.bk_bank_accounts where id = p_bank;
  select * into a from public.bk_accounts where id = b.ledger_account_id;
  return query select l.id, e.entry_date, coalesce(l.description, e.memo), (case when a.type = 'asset' then l.debit_cents - l.credit_cents else l.credit_cents - l.debit_cents end)::bigint, l.cleared
    from public.bk_lines l join public.bk_entries e on e.id = l.entry_id
   where l.account_id = b.ledger_account_id and e.status = 'posted' and e.entry_date <= p_to and l.reconciliation_id is null
   order by e.entry_date, e.number;
end $$;
revoke all on function public.bk_recon_lines(uuid, date) from public, anon;
grant execute on function public.bk_recon_lines(uuid, date) to authenticated;

create or replace function public.bk_reconcile(p_bank uuid, p_date date, p_balance bigint, p_cleared uuid[], p_finish boolean) returns jsonb
 language plpgsql security definer set search_path = public as $$
declare b public.bk_bank_accounts; a public.bk_accounts; prev bigint; cl bigint; diff bigint; rid uuid;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  select * into b from public.bk_bank_accounts where id = p_bank;
  if b.id is null then raise exception 'not_found'; end if;
  select * into a from public.bk_accounts where id = b.ledger_account_id;
  update public.bk_lines l set cleared = (l.id = any(coalesce(p_cleared, '{}'))) where l.account_id = b.ledger_account_id and l.reconciliation_id is null;
  select coalesce(sum(case when a.type = 'asset' then debit_cents - credit_cents else credit_cents - debit_cents end), 0) into prev
    from public.bk_lines l join public.bk_entries e on e.id = l.entry_id where l.account_id = a.id and e.status = 'posted' and l.reconciliation_id is not null;
  select coalesce(sum(case when a.type = 'asset' then debit_cents - credit_cents else credit_cents - debit_cents end), 0) into cl
    from public.bk_lines l join public.bk_entries e on e.id = l.entry_id where l.account_id = a.id and e.status = 'posted' and l.reconciliation_id is null and l.cleared and e.entry_date <= p_date;
  diff := p_balance - (prev + cl);
  if p_finish then
    if diff <> 0 then raise exception 'not_balanced'; end if;
    insert into public.bk_reconciliations(company_id, bank_account_id, statement_date, statement_balance_cents, status, completed_at, created_by)
    values (b.company_id, b.id, p_date, p_balance, 'completed', now(), auth.jwt()->>'email') returning id into rid;
    update public.bk_lines l set reconciliation_id = rid from public.bk_entries e
     where e.id = l.entry_id and l.account_id = a.id and l.reconciliation_id is null and l.cleared and e.entry_date <= p_date;
  end if;
  return jsonb_build_object('opening', prev, 'cleared', cl, 'difference', diff, 'reconciliation_id', rid);
end $$;
revoke all on function public.bk_reconcile(uuid, date, bigint, uuid[], boolean) from public, anon;
grant execute on function public.bk_reconcile(uuid, date, bigint, uuid[], boolean) to authenticated;

-- daily bank sync (the books function pulls new transactions for every active connection)
create or replace function public.books_tick() returns void language plpgsql security definer set search_path = public as $$
declare k text;
begin
  if not exists (select 1 from public.bk_connections where status in ('active', 'error') and provider in ('stripe', 'plaid')) then return; end if;
  select decrypted_secret into k from vault.decrypted_secrets where name = 'booking_hook_key';
  perform net.http_post(url := 'https://onaewjlozioderwlvgfm.supabase.co/functions/v1/books', body := jsonb_build_object('action', 'tick'),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-booking-key', k), timeout_milliseconds := 120000);
end $$;
revoke all on function public.books_tick() from public, anon, authenticated;
do $$ begin
  if exists (select 1 from cron.job where jobname = 'books-sync') then perform cron.unschedule('books-sync'); end if;
  perform cron.schedule('books-sync', '17 9 * * *', 'select public.books_tick();');
end $$;
