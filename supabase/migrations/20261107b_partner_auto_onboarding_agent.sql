-- Partner self-onboarding with automatic activation + the Admin agent (AI): conversations, nudges, escalation

-- agent settings live with the CRM settings
alter table public.crm_settings add column if not exists agent_enabled boolean not null default true;
alter table public.crm_settings add column if not exists agent_chat_enabled boolean not null default true;
alter table public.crm_settings add column if not exists agent_stuck_days int not null default 2 check (agent_stuck_days between 1 and 14);
alter table public.crm_settings add column if not exists agent_escalate_days int not null default 6 check (agent_escalate_days between 2 and 30);

-- what the agent did with each partner
alter table public.partners add column if not exists agent_nudges int not null default 0;
alter table public.partners add column if not exists agent_last_nudge_at timestamptz;
alter table public.partners add column if not exists agent_escalated_at timestamptz;
alter table public.partners add column if not exists onboarding_step_at timestamptz;
alter table public.partners add column if not exists whatsapp_last_inbound_at timestamptz;

-- conversations with the agents (portal chat, WhatsApp, e-mails the agent wrote)
create table if not exists public.agent_messages (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  agent text not null default 'admin' check (agent in ('admin','billing','marketing')),
  partner_id uuid references public.partners(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete cascade,
  channel text not null check (channel in ('portal','whatsapp','email','system')),
  role text not null check (role in ('user','assistant','system')),
  content text not null check (char_length(content) <= 6000),
  meta jsonb not null default '{}'::jsonb
);
create index if not exists agent_messages_partner on public.agent_messages(partner_id, created_at desc);
alter table public.agent_messages enable row level security;
drop policy if exists agent_messages_admin on public.agent_messages;
create policy agent_messages_admin on public.agent_messages for select to authenticated using (public.is_admin());
drop policy if exists agent_messages_partner on public.agent_messages;
create policy agent_messages_partner on public.agent_messages for select to authenticated
  using (channel in ('portal','whatsapp') and partner_id is not null and partner_id = public.my_partner_id());

-- activation: every onboarding step done -> account active (pending -> approved), automatically
create or replace function public.partner_try_activate(p_partner uuid) returns setof public.partners
language plpgsql security definer set search_path = public as $$
declare p public.partners%rowtype; v_video text; ok boolean;
begin
  select * into p from public.partners where id = p_partner for update;
  if not found then return; end if;
  select partner_video_url into v_video from public.crm_settings where id = 1;
  ok := p.status = 'active'
    and (v_video is null or p.video_seen_at is not null)
    and p.contract_status in ('partner_signed','signed')
    and ((p.payout_method = 'stripe' and (p.stripe_details_submitted or p.stripe_transfers_active)) or p.payout_method = 'global_payouts');
  if ok and p.onboarding_done_at is null then
    update public.partners set onboarding_done_at = now(),
      program_status = case when program_status = 'pending' then 'approved' else program_status end,
      approved_at = case when program_status = 'pending' then now() else approved_at end,
      approved_by = case when program_status = 'pending' then 'onboarding-automatico' else approved_by end,
      default_share_pct = coalesce(default_share_pct, contract_pct, 10)
     where id = p.id;
    insert into public.admin_events(kind, title, body, link)
    values ('partner_new', 'Parceiro ativado: ' || p.name, 'Concluiu o onboarding (vídeo, contrato e recebimentos). Já pode indicar clientes e agendar a conversa de boas-vindas.', '#/parceiros?id=' || p.id);
    insert into public.agent_messages(agent, partner_id, channel, role, content) values ('admin', p.id, 'system', 'system', 'Onboarding concluído: conta ativada automaticamente.');
  end if;
  return query select * from public.partners where id = p.id;
end $$;
revoke all on function public.partner_try_activate(uuid) from public, anon, authenticated;

-- the partner's own check (called by the portal after each step)
create or replace function public.partner_onboarding_check() returns setof public.partners
language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  select id into v from public.partners where user_id = auth.uid() and status = 'active';
  if v is null then return; end if;
  return query select * from public.partner_try_activate(v);
end $$;
revoke all on function public.partner_onboarding_check() from public, anon;
grant execute on function public.partner_onboarding_check() to authenticated;

-- each step updates the "last progress" clock (the agent nudges only after N days without progress) and tries to activate
create or replace function public.partner_onboarding_mark(p_step text)
returns setof public.partners language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  select id into v from public.partners where user_id = auth.uid();
  if v is null then return; end if;
  if p_step = 'video' then update public.partners set video_seen_at = coalesce(video_seen_at, now()), onboarding_step_at = now() where id = v;
  elsif p_step = 'done' then null;
  else raise exception 'invalid_step'; end if;
  return query select * from public.partner_try_activate(v);
end $$;
revoke all on function public.partner_onboarding_mark(text) from public, anon;
grant execute on function public.partner_onboarding_mark(text) to authenticated;

create or replace function public.partner_set_payout(p_method text, p_country text, p_pix text default null, p_pix_type text default null)
returns setof public.partners language plpgsql security definer set search_path = public as $$
declare v_pix text := nullif(trim(coalesce(p_pix, '')), ''); v uuid;
begin
  if p_method not in ('stripe','global_payouts') then raise exception 'invalid_method'; end if;
  if p_country is null or p_country !~ '^[A-Z]{2}$' then raise exception 'invalid_country'; end if;
  if v_pix is not null then
    if p_pix_type is null or p_pix_type not in ('email','phone','random') then raise exception 'invalid_pix'; end if;
    if p_pix_type = 'email' and v_pix !~* '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$' then raise exception 'invalid_pix'; end if;
    if p_pix_type = 'phone' and v_pix !~ '^\+?[0-9 ()-]{10,20}$' then raise exception 'invalid_pix'; end if;
    if p_pix_type = 'random' and v_pix !~* '^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$' then raise exception 'invalid_pix'; end if;
  end if;
  select id into v from public.partners where user_id = auth.uid() and status = 'active';
  if v is null then raise exception 'forbidden'; end if;
  update public.partners set payout_method = p_method, payout_country = p_country, onboarding_step_at = now(),
    global_payouts_status = case when p_method = 'global_payouts' and global_payouts_status = 'none' then 'requested' when p_method = 'stripe' then 'none' else global_payouts_status end,
    pix_key = v_pix, pix_key_type = case when v_pix is null then null else p_pix_type end
   where id = v;
  if p_method = 'global_payouts' then
    insert into public.admin_events(kind, title, body, link)
    select 'partner_new', 'Parceiro quer receber fora dos EUA: ' || p.name, 'Global Payouts (' || p_country || '). Cadastre o parceiro como destinatário no Stripe para ele informar o banco.', '#/parceiros?id=' || p.id || '&tab=stripe'
      from public.partners p where p.id = v and p.global_payouts_status = 'requested';
  end if;
  return query select * from public.partner_try_activate(v);
end $$;
revoke all on function public.partner_set_payout(text, text, text, text) from public, anon;
grant execute on function public.partner_set_payout(text, text, text, text) to authenticated;

-- referrals only after activation (already: submit_referral refuses while program_status = 'pending')

-- a welcome-call booking from an existing partner links to the partner instead of creating a "partner prospect"
create or replace function public.booking_partner_lead() returns trigger language plpgsql security definer set search_path = public as $$
declare v_p uuid;
begin
  if new.lead_id is null then return new; end if;
  select id into v_p from public.partners where lower(email) = lower(new.email) limit 1;
  if v_p is not null then
    update public.leads set kind = 'partner', status = 'partner', partner_id = v_p where id = new.lead_id and status not in ('client');
  elsif coalesce(new.topic, '') ~* '^(partner program|programa de parceiros|programa de socios)$' then
    update public.leads set kind = 'partner' where id = new.lead_id and kind = 'lead' and status in ('new','contacted');
  end if;
  return new;
end $$;
