-- AI sales and support chat on the public website
alter table public.leads drop constraint if exists leads_source_check;
alter table public.leads add constraint leads_source_check check (source = any (array['contact_form','booking','manual','partner','chat']));
alter table public.admin_events drop constraint if exists admin_events_kind_check;
alter table public.admin_events add constraint admin_events_kind_check check (kind = any (array['proposal_accepted','payment_received','payment_failed','referral_new','oa_review','oa_client','oa_signature','oa_archived','booking_new','booking_cancelled','booking_rescheduled','partner_new','partner_contract','lead_chat']));

alter table public.crm_settings add column if not exists site_chat_enabled boolean not null default true;
alter table public.crm_settings add column if not exists site_chat_popup_seconds int not null default 8 check (site_chat_popup_seconds between 0 and 120);

create table if not exists public.site_chats (
  id uuid primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  ip_hash text,
  language text,
  page text,
  lead_id uuid references public.leads(id) on delete set null,
  messages int not null default 0,
  handoff boolean not null default false
);
create index if not exists site_chats_updated on public.site_chats(updated_at desc);
create index if not exists site_chats_ip on public.site_chats(ip_hash, created_at desc);
create table if not exists public.site_chat_messages (
  id bigint generated always as identity primary key,
  chat_id uuid not null references public.site_chats(id) on delete cascade,
  created_at timestamptz not null default now(),
  role text not null check (role in ('user','assistant','system')),
  content text not null check (char_length(content) <= 6000)
);
create index if not exists site_chat_messages_chat on public.site_chat_messages(chat_id, created_at);
alter table public.site_chats enable row level security;
alter table public.site_chat_messages enable row level security;
drop policy if exists site_chats_admin on public.site_chats;
create policy site_chats_admin on public.site_chats for select to authenticated using (public.is_admin());
drop policy if exists site_chat_messages_admin on public.site_chat_messages;
create policy site_chat_messages_admin on public.site_chat_messages for select to authenticated using (public.is_admin());
-- the widget reads only whether the chat is on and the popup delay
create or replace function public.site_chat_config() returns table(enabled boolean, popup_seconds int)
language sql security definer set search_path = public stable as $$ select coalesce(site_chat_enabled, true), coalesce(site_chat_popup_seconds, 8) from public.crm_settings where id = 1 $$;
grant execute on function public.site_chat_config() to anon, authenticated;
