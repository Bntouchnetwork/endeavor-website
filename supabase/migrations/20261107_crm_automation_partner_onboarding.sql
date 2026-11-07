-- Smart CRM automations + partner onboarding (video, payout method, checklist)

-- settings (one row): automations on/off, onboarding video
create table if not exists public.crm_settings (
  id int primary key default 1 check (id = 1),
  followup_enabled boolean not null default true,
  followup_days int[] not null default '{2,7}',
  partner_reminders boolean not null default true,
  partner_notify boolean not null default true,
  whatsapp_enabled boolean not null default false,
  partner_video_url text check (partner_video_url is null or partner_video_url ~ '^https://'),
  partner_video_updated_at timestamptz,
  notify_since timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text
);
insert into public.crm_settings(id) values (1) on conflict do nothing;
alter table public.crm_settings enable row level security;
drop policy if exists crm_settings_read on public.crm_settings;
create policy crm_settings_read on public.crm_settings for select to authenticated using (true);
drop policy if exists crm_settings_admin on public.crm_settings;
create policy crm_settings_admin on public.crm_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- every automatic message (one row per message; the unique key stops duplicates)
create table if not exists public.crm_messages (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  dedupe text not null unique,
  kind text not null,
  channel text not null check (channel in ('email','whatsapp')),
  lead_id uuid references public.leads(id) on delete cascade,
  partner_id uuid references public.partners(id) on delete cascade,
  referral_id uuid references public.referrals(id) on delete cascade,
  to_addr text,
  subject text,
  status text not null default 'sending' check (status in ('sending','sent','failed','skipped')),
  error text,
  sent_at timestamptz,
  created_by text
);
create index if not exists crm_messages_lead on public.crm_messages(lead_id);
create index if not exists crm_messages_partner on public.crm_messages(partner_id);
alter table public.crm_messages enable row level security;
drop policy if exists crm_messages_admin on public.crm_messages;
create policy crm_messages_admin on public.crm_messages for select to authenticated using (public.is_admin());

-- CRM: partner prospects, follow-up control
alter table public.leads drop constraint if exists leads_kind_check;
alter table public.leads add constraint leads_kind_check check (kind = any (array['lead','prospect','client','partner']));
alter table public.leads drop constraint if exists leads_status_check;
alter table public.leads add constraint leads_status_check check (status = any (array['new','contacted','qualified','proposal','client','partner','lost']));
alter table public.leads add column if not exists followup_stop boolean not null default false;
alter table public.leads add column if not exists last_contact_at timestamptz;
alter table public.leads add column if not exists partner_id uuid references public.partners(id) on delete set null;

-- a booking for the "Partner Program" topic makes the lead a partner prospect
create or replace function public.lead_partner_kind() returns trigger language plpgsql set search_path = public as $$
begin
  if new.kind = 'lead' and coalesce(new.assistance, '') ~* '^(partner program|programa de parceiros|programa de socios)$' then new.kind := 'partner'; end if;
  return new;
end $$;
drop trigger if exists leads_partner_kind on public.leads;
create trigger leads_partner_kind before insert on public.leads for each row execute function public.lead_partner_kind();
create or replace function public.booking_partner_lead() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.lead_id is not null and coalesce(new.topic, '') ~* '^(partner program|programa de parceiros|programa de socios)$' then
    update public.leads set kind = 'partner' where id = new.lead_id and kind = 'lead' and status in ('new','contacted');
  end if;
  return new;
end $$;
drop trigger if exists bookings_partner_lead on public.bookings;
create trigger bookings_partner_lead after insert on public.bookings for each row execute function public.booking_partner_lead();
update public.leads l set kind = 'partner' where kind = 'lead' and coalesce(assistance,'') ~* '^(partner program|programa de parceiros|programa de socios)$';

-- partners: onboarding checklist and how they get paid
alter table public.partners add column if not exists payout_method text check (payout_method is null or payout_method in ('stripe','global_payouts'));
alter table public.partners add column if not exists payout_country text check (payout_country is null or payout_country ~ '^[A-Z]{2}$');
alter table public.partners add column if not exists global_payouts_status text not null default 'none' check (global_payouts_status in ('none','requested','link_sent','ready'));
alter table public.partners add column if not exists pix_key text check (pix_key is null or char_length(pix_key) <= 140);
alter table public.partners add column if not exists pix_key_type text check (pix_key_type is null or pix_key_type in ('email','phone','random'));
alter table public.partners add column if not exists video_seen_at timestamptz;
alter table public.partners add column if not exists onboarding_done_at timestamptz;

-- commissions paid outside Stripe Connect (Global Payouts now, Pix later)
alter table public.invoices add column if not exists payout_channel text check (payout_channel is null or payout_channel in ('connect','global_payouts','pix','other'));
alter table public.invoices add column if not exists payout_note text check (payout_note is null or char_length(payout_note) <= 500);
alter table public.invoices add column if not exists payout_paid_at timestamptz;

-- partner: choose how to receive (no bank numbers here: Stripe collects them; Pix only e-mail, phone or random key)
create or replace function public.partner_set_payout(p_method text, p_country text, p_pix text default null, p_pix_type text default null)
returns setof public.partners language plpgsql security definer set search_path = public as $$
declare v_pix text := nullif(trim(coalesce(p_pix, '')), '');
begin
  if p_method not in ('stripe','global_payouts') then raise exception 'invalid_method'; end if;
  if p_country is null or p_country !~ '^[A-Z]{2}$' then raise exception 'invalid_country'; end if;
  if v_pix is not null then
    if p_pix_type = 'email' and v_pix !~* '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$' then raise exception 'invalid_pix'; end if;
    if p_pix_type = 'phone' and v_pix !~ '^\+?[0-9 ()-]{10,20}$' then raise exception 'invalid_pix'; end if;
    if p_pix_type = 'random' and v_pix !~* '^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$' then raise exception 'invalid_pix'; end if;
    if p_pix_type is null or p_pix_type not in ('email','phone','random') then raise exception 'invalid_pix'; end if;
  end if;
  update public.partners set payout_method = p_method, payout_country = p_country,
    global_payouts_status = case when p_method = 'global_payouts' and global_payouts_status = 'none' then 'requested' when p_method = 'stripe' then 'none' else global_payouts_status end,
    pix_key = v_pix, pix_key_type = case when v_pix is null then null else p_pix_type end
   where user_id = auth.uid() and status = 'active';
  if p_method = 'global_payouts' then
    insert into public.admin_events(kind, title, body, link)
    select 'partner_new', 'Parceiro quer receber fora dos EUA: ' || p.name, 'Global Payouts (' || p_country || '). Envie o link de cadastro bancário do Stripe.', '#/parceiros?id=' || p.id || '&tab=stripe'
      from public.partners p where p.user_id = auth.uid() and p.global_payouts_status = 'requested';
  end if;
  return query select * from public.partners where user_id = auth.uid();
end $$;
revoke all on function public.partner_set_payout(text, text, text, text) from public, anon;
grant execute on function public.partner_set_payout(text, text, text, text) to authenticated;

create or replace function public.partner_onboarding_mark(p_step text)
returns setof public.partners language plpgsql security definer set search_path = public as $$
begin
  if p_step = 'video' then update public.partners set video_seen_at = coalesce(video_seen_at, now()) where user_id = auth.uid();
  elsif p_step = 'done' then update public.partners set onboarding_done_at = coalesce(onboarding_done_at, now()) where user_id = auth.uid();
  else raise exception 'invalid_step'; end if;
  return query select * from public.partners where user_id = auth.uid();
end $$;
revoke all on function public.partner_onboarding_mark(text) from public, anon;
grant execute on function public.partner_onboarding_mark(text) to authenticated;

-- media bucket for the onboarding video (public read, admin write)
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 52428800, array['video/mp4','video/webm','video/quicktime'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists media_admin_insert on storage.objects;
create policy media_admin_insert on storage.objects for insert to authenticated with check (bucket_id = 'media' and public.is_admin());
drop policy if exists media_admin_update on storage.objects;
create policy media_admin_update on storage.objects for update to authenticated using (bucket_id = 'media' and public.is_admin());
drop policy if exists media_admin_delete on storage.objects;
create policy media_admin_delete on storage.objects for delete to authenticated using (bucket_id = 'media' and public.is_admin());

-- cron: CRM automations every 10 minutes (only calls the function when something may be due)
create or replace function public.crm_tick() returns void language plpgsql security definer set search_path = public as $$
declare k text;
begin
  select decrypted_secret into k from vault.decrypted_secrets where name = 'booking_hook_key';
  perform net.http_post(
    url := 'https://onaewjlozioderwlvgfm.supabase.co/functions/v1/crm',
    body := jsonb_build_object('event', 'tick'),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-booking-key', k),
    timeout_milliseconds := 60000);
end $$;
revoke all on function public.crm_tick() from public, anon, authenticated;
select cron.unschedule('crm-automations') where exists (select 1 from cron.job where jobname = 'crm-automations');
select cron.schedule('crm-automations', '*/10 * * * *', 'select public.crm_tick();');
