-- Online store on the home page + client tools in the portal.
--   store_products   catalog shown on the home page (prices are editable in Admin > Pagamentos > Loja)
--   store_orders     each purchase started on the site or in the portal (Stripe Checkout, embedded)
--   client_services  what each client account has contracted (unlocks the tool in the portal)
--   clients.portal_kind  'full' (formation clients, created by Endeavor) or 'tools' (account created by an online purchase)
--   CRM (ct_contacts, ct_notes), scheduling (ct_booking_pages, ct_appointments) and e-signature (envelopes.client_id)
--   for the client's own business. Bookkeeping stays a service done by Endeavor; the client connects accounts and sees the status.

-- ---------------------------------------------------------------- catalog, orders, services
create table if not exists public.store_products (
  code text primary key check (code ~ '^[a-z_]{2,40}$'),
  price_cents integer not null check (price_cents >= 0),
  interval text not null default 'month' check (interval in ('month', 'year', 'once')),
  currency text not null default 'usd',
  status text not null default 'active' check (status in ('active', 'coming_soon', 'hidden')),
  sort integer not null default 0,
  updated_at timestamptz not null default now()
);
insert into public.store_products (code, price_cents, interval, status, sort) values
  ('crm', 2900, 'month', 'active', 10),
  ('agenda', 1900, 'month', 'active', 20),
  ('esign', 1900, 'month', 'active', 30),
  ('bookkeeping', 19900, 'month', 'active', 40),
  ('registered_agent', 14900, 'year', 'coming_soon', 50),
  ('virtual_address', 4900, 'month', 'coming_soon', 60)
on conflict (code) do nothing;
alter table public.store_products enable row level security;
drop policy if exists sp_public_read on public.store_products;
create policy sp_public_read on public.store_products for select using (status <> 'hidden'); -- visitors (anon) cannot call is_admin()
drop policy if exists sp_admin on public.store_products;
create policy sp_admin on public.store_products for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select on public.store_products to anon, authenticated;

create table if not exists public.store_orders (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  product_code text not null references public.store_products(code),
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  name text not null check (char_length(name) between 2 and 120),
  phone text,
  company text,
  lang text not null default 'pt' check (lang in ('pt', 'en', 'es')),
  client_id uuid references public.clients(id) on delete set null,
  buyer_user_id uuid,
  source text not null default 'site' check (source in ('site', 'portal')),
  status text not null default 'pending' check (status in ('pending', 'paid', 'fulfilled', 'failed', 'expired')),
  amount_cents integer not null default 0,
  stripe_session_id text unique,
  stripe_subscription_id text,
  stripe_customer_id text,
  fulfilled_at timestamptz,
  error text,
  ip_hash text
);
create index if not exists store_orders_email_idx on public.store_orders (lower(email), created_at desc);
alter table public.store_orders enable row level security;
drop policy if exists so_admin on public.store_orders;
create policy so_admin on public.store_orders for all using (public.is_admin()) with check (public.is_admin());

create table if not exists public.client_services (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  product_code text not null references public.store_products(code),
  status text not null default 'active' check (status in ('active', 'past_due', 'canceled')),
  stripe_subscription_id text,
  order_id uuid references public.store_orders(id) on delete set null,
  started_at timestamptz not null default now(),
  canceled_at timestamptz,
  unique (client_id, product_code)
);
create index if not exists client_services_sub_idx on public.client_services (stripe_subscription_id);
alter table public.client_services enable row level security;
drop policy if exists cs_member_read on public.client_services;
create policy cs_member_read on public.client_services for select using (public.my_client_role(client_id) is not null);
drop policy if exists cs_admin on public.client_services;
create policy cs_admin on public.client_services for all using (public.is_admin()) with check (public.is_admin());

alter table public.clients add column if not exists portal_kind text not null default 'full';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'clients_portal_kind_check') then
    alter table public.clients add constraint clients_portal_kind_check check (portal_kind in ('full', 'tools'));
  end if;
end $$;

create or replace function public.client_has_service(p_client uuid, p_code text) returns boolean
language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from public.client_services s where s.client_id = p_client and s.product_code = p_code and s.status in ('active', 'past_due'))
$$;
-- the account owner (with the authenticator) of a client that has the service
create or replace function public.my_tool(p_client uuid, p_code text) returns boolean
language sql stable security definer set search_path to 'public' as $$
  select public.my_client_role(p_client) = 'owner' and public.client_has_service(p_client, p_code)
$$;

-- ---------------------------------------------------------------- CRM for the client's own business
create table if not exists public.ct_contacts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null check (char_length(name) between 1 and 160),
  email text check (email is null or char_length(email) <= 254),
  phone text check (phone is null or char_length(phone) <= 40),
  company text check (company is null or char_length(company) <= 160),
  stage text not null default 'new' check (stage in ('new', 'contacted', 'proposal', 'won', 'lost')),
  value_cents bigint not null default 0 check (value_cents >= 0),
  source text check (source is null or char_length(source) <= 60),
  next_action text check (next_action is null or char_length(next_action) <= 300),
  next_action_at date,
  notes text check (notes is null or char_length(notes) <= 4000)
);
create index if not exists ct_contacts_client_idx on public.ct_contacts (client_id, stage, updated_at desc);
create table if not exists public.ct_notes (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.ct_contacts(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by text,
  body text not null check (char_length(body) between 1 and 4000)
);
create index if not exists ct_notes_contact_idx on public.ct_notes (contact_id, created_at desc);
alter table public.ct_contacts enable row level security;
alter table public.ct_notes enable row level security;
drop policy if exists ctc_owner on public.ct_contacts;
create policy ctc_owner on public.ct_contacts for all using (public.my_tool(client_id, 'crm') or public.is_admin()) with check (public.my_tool(client_id, 'crm') or public.is_admin());
drop policy if exists ctn_owner on public.ct_notes;
create policy ctn_owner on public.ct_notes for all
  using (public.my_tool(client_id, 'crm') or public.is_admin())
  with check ((public.my_tool(client_id, 'crm') or public.is_admin()) and exists (select 1 from public.ct_contacts c where c.id = contact_id and c.client_id = ct_notes.client_id));
create or replace function public.ct_touch() returns trigger language plpgsql set search_path to 'public' as $$ begin new.updated_at = now(); return new; end $$;
drop trigger if exists ct_contacts_touch on public.ct_contacts;
create trigger ct_contacts_touch before update on public.ct_contacts for each row execute function public.ct_touch();

-- ---------------------------------------------------------------- scheduling for the client's own business
create table if not exists public.ct_booking_pages (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null unique references public.clients(id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$'),
  title text not null default 'Agende um horário' check (char_length(title) between 2 and 120),
  description text check (description is null or char_length(description) <= 1000),
  duration_min integer not null default 30 check (duration_min between 10 and 240),
  buffer_min integer not null default 0 check (buffer_min between 0 and 120),
  timezone text not null default 'America/New_York',
  rules jsonb not null default '{"1":[["09:00","17:00"]],"2":[["09:00","17:00"]],"3":[["09:00","17:00"]],"4":[["09:00","17:00"]],"5":[["09:00","17:00"]]}'::jsonb,
  blackouts date[] not null default '{}',
  min_notice_hours integer not null default 4 check (min_notice_hours between 0 and 336),
  max_days_ahead integer not null default 45 check (max_days_ahead between 1 and 180),
  location_kind text not null default 'video' check (location_kind in ('video', 'phone', 'in_person')),
  meeting_info text check (meeting_info is null or char_length(meeting_info) <= 500),
  notify_email text,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);
create table if not exists public.ct_appointments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  page_id uuid not null references public.ct_booking_pages(id) on delete cascade,
  created_at timestamptz not null default now(),
  start_at timestamptz not null,
  end_at timestamptz not null,
  name text not null check (char_length(name) between 2 and 120),
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone text check (phone is null or char_length(phone) <= 40),
  notes text check (notes is null or char_length(notes) <= 1000),
  timezone text,
  status text not null default 'confirmed' check (status in ('confirmed', 'cancelled')),
  cancelled_by text,
  token uuid not null default gen_random_uuid() unique
);
create index if not exists ct_appt_page_idx on public.ct_appointments (page_id, start_at) where status = 'confirmed';
alter table public.ct_booking_pages enable row level security;
alter table public.ct_appointments enable row level security;
drop policy if exists ctp_owner on public.ct_booking_pages;
create policy ctp_owner on public.ct_booking_pages for all using (public.my_tool(client_id, 'agenda') or public.is_admin()) with check (public.my_tool(client_id, 'agenda') or public.is_admin());
drop policy if exists cta_owner_read on public.ct_appointments;
create policy cta_owner_read on public.ct_appointments for select using (public.my_tool(client_id, 'agenda') or public.is_admin());
drop trigger if exists ct_pages_touch on public.ct_booking_pages;
create trigger ct_pages_touch before update on public.ct_booking_pages for each row execute function public.ct_touch();

-- public info of an active booking page (no e-mail, no meeting link: those go only to the person who books)
create or replace function public.ct_page_public(p_slug text) returns table (business text, title text, description text, duration_min int, timezone text, location_kind text, max_days_ahead int)
language sql stable security definer set search_path to 'public' as $$
  select c.name, p.title, p.description, p.duration_min, p.timezone, p.location_kind, p.max_days_ahead
  from public.ct_booking_pages p join public.clients c on c.id = p.client_id
  where p.slug = lower(p_slug) and p.active and c.status = 'active' and public.client_has_service(p.client_id, 'agenda')
$$;

-- free start times between two dates (inclusive), in UTC; respects weekly hours, blocked dates, notice, buffer and existing bookings
create or replace function public.ct_slots(p_slug text, p_from date, p_to date) returns setof timestamptz
language plpgsql stable security definer set search_path to 'public' as $$
declare p public.ct_booking_pages; d date; iv jsonb; s timestamptz; e timestamptz; step interval; dur interval; buf interval; last_day date;
begin
  select * into p from public.ct_booking_pages where slug = lower(p_slug) and active;
  if not found or not public.client_has_service(p.client_id, 'agenda') then return; end if;
  dur := make_interval(mins => p.duration_min); buf := make_interval(mins => p.buffer_min); step := dur + buf;
  last_day := least(p_to, (now() at time zone p.timezone)::date + p.max_days_ahead, p_from + 62);
  d := greatest(p_from, (now() at time zone p.timezone)::date);
  while d <= last_day loop
    if not (d = any (p.blackouts)) then
      for iv in select * from jsonb_array_elements(coalesce(p.rules -> extract(isodow from d)::int::text, '[]'::jsonb)) loop
        s := (d + (iv ->> 0)::time) at time zone p.timezone;
        e := (d + (iv ->> 1)::time) at time zone p.timezone;
        while s + dur <= e loop
          if s >= now() + make_interval(hours => p.min_notice_hours)
             and not exists (select 1 from public.ct_appointments a where a.page_id = p.id and a.status = 'confirmed'
                               and a.start_at < s + dur + buf and a.end_at + buf > s) then
            return next s;
          end if;
          s := s + step;
        end loop;
      end loop;
    end if;
    d := d + 1;
  end loop;
end $$;

-- booking (called only by the tools function, with the service key): the time must still be free
create or replace function public.ct_book(p_slug text, p_start timestamptz, p_name text, p_email text, p_phone text, p_notes text, p_tz text)
returns public.ct_appointments language plpgsql security definer set search_path to 'public' as $$
declare p public.ct_booking_pages; r public.ct_appointments; local_day date;
begin
  select * into p from public.ct_booking_pages where slug = lower(p_slug) and active for update;
  if not found or not public.client_has_service(p.client_id, 'agenda') then raise exception 'page_not_found'; end if;
  local_day := (p_start at time zone p.timezone)::date;
  if not exists (select 1 from public.ct_slots(p_slug, local_day, local_day) x where x = p_start) then raise exception 'slot_unavailable'; end if;
  insert into public.ct_appointments (client_id, page_id, start_at, end_at, name, email, phone, notes, timezone)
  values (p.client_id, p.id, p_start, p_start + make_interval(mins => p.duration_min), left(trim(p_name), 120), lower(trim(p_email)),
          nullif(left(trim(coalesce(p_phone, '')), 40), ''), nullif(left(trim(coalesce(p_notes, '')), 1000), ''), left(coalesce(p_tz, p.timezone), 64))
  returning * into r;
  return r;
end $$;
revoke all on function public.ct_book(text, timestamptz, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.ct_page_public(text) to anon, authenticated;
grant execute on function public.ct_slots(text, date, date) to anon, authenticated;

-- ---------------------------------------------------------------- e-signature for the client's own documents
alter table public.envelopes add column if not exists client_id uuid references public.clients(id) on delete cascade;
create index if not exists envelopes_client_idx on public.envelopes (client_id, created_at desc) where client_id is not null;
drop policy if exists envelopes_owner_read on public.envelopes;
create policy envelopes_owner_read on public.envelopes for select using (client_id is not null and public.my_client_role(client_id) = 'owner');
drop policy if exists envelopes_owner_insert on public.envelopes;
create policy envelopes_owner_insert on public.envelopes for insert with check (
  client_id is not null and public.my_tool(client_id, 'esign') and oa_id is null and lead_id is null and status = 'sent'
  and document_path like 'clients/' || client_id::text || '/%');
drop policy if exists events_owner_read on public.envelope_events;
create policy events_owner_read on public.envelope_events for select using (exists (select 1 from public.envelopes e where e.id = envelope_id and e.client_id is not null and public.my_client_role(e.client_id) = 'owner'));
drop policy if exists events_owner_insert on public.envelope_events;
create policy events_owner_insert on public.envelope_events for insert with check (
  event in ('sent', 'link_copied', 'downloaded', 'emailed')
  and exists (select 1 from public.envelopes e where e.id = envelope_id and e.client_id is not null and public.my_client_role(e.client_id) = 'owner'));
create or replace function public.client_void_envelope(p_id uuid) returns boolean
language plpgsql security definer set search_path to 'public' as $$
declare c uuid;
begin
  select client_id into c from public.envelopes where id = p_id and status in ('sent', 'viewed');
  if c is null or public.my_client_role(c) is distinct from 'owner' then return false; end if;
  update public.envelopes set status = 'voided' where id = p_id;
  insert into public.envelope_events (envelope_id, event, details) values (p_id, 'voided', jsonb_build_object('by', 'client'));
  return true;
end $$;
grant execute on function public.client_void_envelope(uuid) to authenticated;

drop policy if exists documents_owner_insert on storage.objects;
create policy documents_owner_insert on storage.objects for insert with check (
  bucket_id = 'documents' and (storage.foldername(name))[1] = 'clients'
  and public.my_tool(public.try_uuid((storage.foldername(name))[2]), 'esign'));
drop policy if exists documents_owner_select on storage.objects;
create policy documents_owner_select on storage.objects for select using (
  bucket_id = 'documents' and exists (select 1 from public.envelopes e where e.client_id is not null
    and (e.document_path = objects.name or e.signed_document_path = objects.name) and public.my_client_role(e.client_id) = 'owner'));

-- ---------------------------------------------------------------- bookkeeping: what the client sees about its connected accounts
create or replace function public.client_bk_status(p_company uuid) returns jsonb
language plpgsql stable security definer set search_path to 'public' as $$
declare co public.companies;
begin
  select * into co from public.companies where id = p_company;
  if not found or public.my_client_role(co.client_id) is distinct from 'owner' then raise exception 'forbidden'; end if;
  return jsonb_build_object(
    'enabled', co.books_provider = 'endeavor',
    'connections', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'provider', c.provider, 'institution', c.institution, 'status', c.status, 'last_sync_at', c.last_sync_at) order by c.created_at)
       from public.bk_connections c where c.company_id = co.id and c.status <> 'disconnected' and c.provider in ('stripe', 'plaid')), '[]'::jsonb),
    'accounts', coalesce((select jsonb_agg(jsonb_build_object('name', a.name, 'mask', a.mask, 'kind', a.kind, 'balance_cents', a.balance_cents, 'balance_at', a.balance_at) order by a.name)
       from public.bk_bank_accounts a where a.company_id = co.id and a.is_active), '[]'::jsonb),
    'transactions', (select count(*) from public.bk_transactions t where t.company_id = co.id),
    'to_review', (select count(*) from public.bk_transactions t where t.company_id = co.id and t.status = 'review'));
end $$;
grant execute on function public.client_bk_status(uuid) to authenticated;
